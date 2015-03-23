/**
 * A callback without a result.
 */
interface Callback {
    (err?: Error): void;
}

export = Callback;