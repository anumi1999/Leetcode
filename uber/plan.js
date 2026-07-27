function minOperationsToZero(n) {
	if (typeof n !== "number" && typeof n !== "bigint") {
		throw new TypeError("n must be a positive integer");
	}

	let value = typeof n === "bigint" ? n : BigInt(n);

	if (value < 0n) {
		throw new RangeError("n must be a positive integer");
	}
	if (value === 0n) {
		return 0;
	}

	let operations = 0;

	while (value > 0n) {
		if (value % 2n === 0n) {
			value /= 2n;
			continue;
		}

		operations += 1;

		if (value === 1n) {
			break;
		}

		if (value % 4n === 1n) {
			value -= 1n;
		} else {
			value += 1n;
		}
	}

	return operations;
}

module.exports = { minOperationsToZero };

if (require.main === module) {
	const tests = [1, 2, 3, 4, 7, 15, 39, 38];
	for (const test of tests) {
		console.log(`${test} -> ${minOperationsToZero(test)}`);
	}
}
