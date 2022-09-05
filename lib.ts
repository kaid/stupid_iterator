export const collect = <T>(iterable: Iterable<T>): Array<T> => Array.from(iterable);

export class Range implements Iterable<number>{
    public readonly end: number;
    public readonly start: number;

    constructor(start: number, end: number) {
        this.end = end;
        this.start = start;
    }

    public *[Symbol.iterator](): Iterator<number> {
        let cursor = this.start;

        while (cursor < this.end) {
            yield cursor++;
        }
    }
}

export class Take<T> implements Iterable<T> {
    private iter: Iterator<T>;
    private readonly num: number;

    constructor(iterable: Iterable<T>, num: number)
    constructor(iterator: Iterator<T>, num: number)
    constructor(iteration: Iterator<T> | Iterable<T>, num: number) {
        this.num = num;

        if ('next' in iteration && iteration.next instanceof Function) {
            this.iter = iteration;
        } else {
            this.iter = iteration[Symbol.iterator]();
        }
    }

    public *[Symbol.iterator](): Iterator<T> {
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
        const bufferLength = this.length;

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

    public *[Symbol.iterator](): Iterator<Array<T>> {
        if (!this.first) {
            this.reset(this.k);
        }

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
        this.pool.prefill(k);
        this.indices = collect(new Range(0, k));
    }
}

type TraversalOption<T> = {
    parent?: T,
    level?: number,
    childrenProp: keyof T,
    skip?: (item: T) => boolean,
    indexSeq?: { count: number },
    iterable?: Iterable<T> | unknown,
}

type DfsYielded<T> = {
    parent?: T,
    index: number,
    level: number,
}

export function* dfsTraverse<T>({ iterable, childrenProp, skip, parent = null, indexSeq, level = 0 }: TraversalOption<T>): Generator<DfsYielded<T>> {
    if (!(iterable?.[Symbol.iterator] instanceof Function)) {
        return;
    }

    const seq = indexSeq || { count: 0 };

    for (const node of iterable as Iterable<T>) {
        if (skip?.(node)) {
            continue;
        }

        yield { parent, level, index: seq.count };

        seq.count++;

        yield* dfsTraverse({
            childrenProp,
            parent: node,
            indexSeq: seq,
            level: level + 1,
            iterable: node[childrenProp],
        });
    }
}
