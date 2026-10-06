class MinHeap{
    private heap: number[] = [];
    size(): number{
        return this.heap.length;
    }
    peek(): number | null{
        if( this.size() === 0 ) return null;
        return this.heap[0];
    }
    push(value: number): void{
        this.heap.push(value);
        this.bubbleUp(this.heap.length - 1);
    }

    pop(): number | null{
        if(this.heap.length === 0) return null;
        const top = this.heap[0];
        const last = this.heap.pop();
        if(this.heap.length > 0 && last !== undefined){
            this.heap[0] = last;
            this.bubbleDown(0);
        }
        return top;
    }

    private bubbleUp(index: number): void{
        while (index > 0) {
            const parentIndex = Math.floor((index - 1) / 2);
            if(this.heap[parentIndex] <= this.heap[index] ) break;
            this.swap(parentIndex, index);
            index = parentIndex;
        }
    }

    private bubbleDown(index: number): void{
        const n = this.heap.length;
        while (true){
            const left = 2 * index + 1;
            const right = 2 * index + 2;
            let smallest = index;
            if( left < n && this.heap[left] < this.heap[smallest]){
                smallest = left;
            }
            if( right < n && this.heap[right] < this.heap[smallest]){
                smallest = right;
            }
            if( smallest === index ){
                break;
            }
            this.swap(smallest, index);
            index = smallest;
        }
    }

    private swap(i: number, j: number): void{
        [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]];
    }
}