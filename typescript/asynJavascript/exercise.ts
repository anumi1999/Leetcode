const delay = (ms: number, value: string): Promise<string> =>
    new Promise((resolve) => {
        setTimeout(() => resolve(value), ms);
    });

async function slowDouble(n: number): Promise<number> {
    if (n < 0) {
        throw new Error("n must not be negative");
    }
    await delay(100, "");     
    return n * 2;             
}

async function main() {
    const nums = [1, 2, 3];

    let start = Date.now();
    const results: number[] = [];
    for( const n of nums ){
        results.push(await slowDouble(n));
    }
    console.log("sequential:", Date.now() - start, "ms");

    start = Date.now();
    const results2 = await Promise.all(nums.map((n) => slowDouble(n)));
    console.log("concurrent:", Date.now() - start, "ms");
}
main();

const p = new Promise<string>((resolve) => {
    setTimeout(() => resolve("x"), 0);
});
p.then((v) => console.log(v));
Promise.resolve().then(() => console.log("y"));
console.log("z");