"""Teach a small open model one job on Tinker: read a sender's card, say what it is. Every step's loss and cost goes to ml/runs/<name>.jsonl.

python ml/train.py --name haunted-1 [--base Qwen/Qwen3-8B] [--steps 400] [--batch 16] [--lr 2e-4]
Needs TINKER_API_KEY in the environment or in .env, and only ever sends the made-up training cards.
"""
import argparse
import json
import random
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from haunted.lookups import env  # noqa: E402
from ml.make_data import build  # noqa: E402

HERE = Path(__file__).parent
RUNS = HERE / 'runs'


def chat(system, user):
    return f'<|im_start|>system\n{system}<|im_end|>\n<|im_start|>user\n{user}<|im_end|>\n<|im_start|>assistant\n<think>\n\n</think>\n\n'


def datum(tok, types, row):
    prompt = tok.encode(chat(row['system'], row['user']), add_special_tokens=False)
    answer = tok.encode(row['answer'] + '<|im_end|>', add_special_tokens=False)
    tokens = prompt + answer
    return types.Datum(model_input=types.ModelInput.from_ints(tokens[:-1]),
                       loss_fn_inputs={'target_tokens': tokens[1:], 'weights': [0.0] * (len(prompt) - 1) + [1.0] * len(answer)})


def read(path):
    return [json.loads(line) for line in open(path, encoding='utf-8')]


def sample_kind(sampler, tok, types, row):
    out = sampler.sample(prompt=types.ModelInput.from_ints(tok.encode(chat(row['system'], row['user']), add_special_tokens=False)), num_samples=1,
                         sampling_params=types.SamplingParams(max_tokens=48, temperature=0.0, stop=['<|im_end|>'])).result()
    text = tok.decode(out.sequences[0].tokens)
    try:
        return json.loads(text.split('<|im_end|>')[0])['kind']
    except Exception:
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--name', default='haunted-1')
    ap.add_argument('--base', default='Qwen/Qwen3-8B')
    ap.add_argument('--steps', type=int, default=400)
    ap.add_argument('--batch', type=int, default=16)
    ap.add_argument('--lr', type=float, default=2e-4)
    ap.add_argument('--rank', type=int, default=32)
    ap.add_argument('--train', type=int, default=4000)
    a = ap.parse_args()

    import os

    import tinker
    from tinker import types
    os.environ.setdefault('TINKER_API_KEY', env('TINKER_API_KEY') or '')
    print(build(train=a.train, heldout=300))
    train, heldout = read(RUNS / 'train.jsonl'), read(RUNS / 'heldout.jsonl')

    service = tinker.ServiceClient()
    client = service.create_lora_training_client(base_model=a.base, rank=a.rank, seed=2026)
    tok = client.get_tokenizer()
    log = open(RUNS / f'{a.name}.jsonl', 'a', encoding='utf-8')
    rnd = random.Random(2026)
    order, used, spent = [], 0, 0
    t0 = time.time()
    for step in range(1, a.steps + 1):
        if len(order) < a.batch:
            order = rnd.sample(train, len(train))
        rows, order = order[:a.batch], order[a.batch:]
        data = [datum(tok, types, r) for r in rows]
        spent += sum(d.model_input.length for d in data)
        # the rate falls away gently over the last half, so the end of the run doesn't undo itself
        lr = a.lr * (1 if step < a.steps / 2 else max(.1, 2 * (1 - step / a.steps)))
        fb = client.forward_backward(data, 'cross_entropy')
        opt = client.optim_step(types.AdamParams(learning_rate=lr))
        result = fb.result()
        opt.result()
        weight = sum(sum(d.loss_fn_inputs['weights'].data if hasattr(d.loss_fn_inputs['weights'], 'data') else d.loss_fn_inputs['weights']) for d in data)
        loss = result.metrics.get('loss:sum', 0) / max(1, weight)
        used += a.batch
        row = {'step': step, 'loss': round(loss, 4), 'cards': used, 'train_tokens': spent, 'seconds': round(time.time() - t0)}
        if step % 50 == 0 or step == a.steps:
            sampler = client.save_weights_and_get_sampling_client(name=f'{a.name}-{step}')
            check = rnd.sample(heldout, 60)
            row['heldout_kind_right'] = sum(sample_kind(sampler, tok, types, r) == r['truth']['kind'] for r in check) / len(check)
            row['checkpoint'] = f'{a.name}-{step}'
        log.write(json.dumps(row) + '\n')
        log.flush()
        print(row)
    print('tokens sent to training:', spent)


if __name__ == '__main__':
    main()
