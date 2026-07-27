class TwoDIterator {
    constructor(matrix) {
        this.matrix = matrix;
        this.row = 0;
        this.col = 0;
        this._advance();
    }

    _advance() {
        while (this.row < this.matrix.length && this.col >= this.matrix[this.row].length) {
            this.row += 1;
            this.col = 0;
        }
    }

    has_next() {
        this._advance();
        return this.row < this.matrix.length;
    }

    next() {
        if (!this.has_next()) {
            throw new Error("No more elements");
        }

        const value = this.matrix[this.row][this.col];
        this.col += 1;
        return value;
    }
}

const it = new TwoDIterator([[1, 2], [3], [], [4, 5, 6]]);
const output = [];
while (it.has_next()) {
    output.push(it.next());
}
console.log(output.join(", "));
