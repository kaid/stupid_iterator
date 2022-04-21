import { cloneDeep, map, range } from 'lodash-es';

export class LazyBuffer<T> {
    public iterator: Iterator<T>;

    private done = false;
    private buffer: Array<T>;

    constructor(iterable: Iterable<T>) {
        this.buffer = [];
        this.iterator = iterable[Symbol.iterator]();
    }

    public get length(): number {
        return this.buffer.length;
    }

    public get(idx: number): T {
        return this.buffer[idx];
    }

    public fetch(): boolean {
        if (this.done) {
            return false;
        }

        const nextItem = this.iterator.next();

        if (nextItem.done) {
            this.done = true;
            return false;
        }

        this.buffer.push(nextItem.value);
        return true;
    }

    public prefill(k: number): void {
        let bufferLength = this.length;

        if (!this.done && k > bufferLength) {
            const delta = k - bufferLength;

            this.buffer = this.buffer.concat(this.take(delta));
            this.done = this.length < k;
        }
    }

    private take(num: number): Array<T> {
        const result = new Array(num);

        for (let i = 0; i < num; i++) {
            result[i] = this.iterator.next().value;
        }

        return result;
    }
}

export class Combinations<T> implements Iterable<Array<T>> {
    private first = true;
    private pool: LazyBuffer<T>;
    private indices: Array<number>;

    constructor(iterable: Iterable<T>, k: number) {
        this.indices = range(0, k);
        this.pool = new LazyBuffer(iterable);
        this.pool.prefill(k);
    }

    public get k(): number {
        return this.indices.length;
    }

    public get n(): number {
        return this.pool.length;
    }

    public [Symbol.iterator](): Iterator<Array<T>> {
        if (!this.first) {
            this.reset(this.k);
        }

        return this.iterator();
    }

    private *iterator(): Iterator<Array<T>> {
        if (this.first) {
            if (this.k > this.n) {
                return;
            }

            this.first = false;
        } else if (this.n === 0) {
            return;
        }

        let indicesIdx = this.n - 1;

        while (true) {
            if (this.indices[indicesIdx] === this.n -1) {
                this.pool.fetch();
            }

            while (this.indices[indicesIdx] === indicesIdx + this.n - this.k) {
                if (indicesIdx <= 0) {
                    return;
                }

                indicesIdx -= 1;
            }

            this.indices[indicesIdx] += 1;

            for (let j of range(indicesIdx + 1, this.k)) {
                this.indices[j] = this.indices[j - 1] + 1;
            }

            yield map(this.indices, bufferIdx => cloneDeep(this.pool.get(bufferIdx)));
        }
    }

    private reset(k: number): void {
        this.first = true;
        this.indices = range(0, k);
        this.pool.prefill(k);
    }
}
