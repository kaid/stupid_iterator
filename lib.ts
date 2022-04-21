export const collect = <T>(iterable: Iterable<T>): Array<T> => [
    ...iterable,
];

export class Range implements Iterable<number>{
    public readonly end: number;
    public readonly start: number;

    constructor(start: number, end: number) {
        this.end = end;
        this.start = start;
    }

    public [Symbol.iterator](): Iterator<number> {
        return this.iterator();
    }

    private *iterator(): Iterator<number> {
        let cursor = this.start;

        while (cursor < this.end) {
            yield cursor++;
        }
    }
}

export class Take<T> implements Iterable<T> {
    private iter: Iterator<T>;
    private readonly num: number;

    constructor(iterator: Iterator<T>, num: number) {
        this.num = num;
        this.iter = iterator;
    }

    public [Symbol.iterator](): Iterator<T> {
        return this.iterator();
    }

    private *iterator(): Iterator<T> {
        for (const _ of new Range(0, this.num)) {
            yield this.iter.next().value;
        }
    }
}


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

            this.buffer = this.buffer.concat(collect(new Take(this.iterator, delta)));
            this.done = this.length < k;
        }
    }
}

export class Combinations<T> implements Iterable<Array<T>> {
    private first = true;
    private pool: LazyBuffer<T>;
    private indices: Array<number>;

    constructor(iterable: Iterable<T>, k: number) {
        this.indices = collect(new Range(0, k));
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
        while (true) {
            if (this.first) {
                if (this.k > this.n) {
                    return;
                }

                this.first = false;
            } else if (this.n === 0) {
                return;
            } else {
                let indicesIdx = this.k - 1;

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

                for (const j of new Range(indicesIdx + 1, this.k)) {
                    this.indices[j] = this.indices[j - 1] + 1;
                }
            }

            yield this.indices.map(bufferIdx => this.pool.get(bufferIdx));
        }
    }

    private reset(k: number): void {
        this.first = true;
        this.indices = collect(new Range(0, k));
        this.pool.prefill(k);
    }
}
