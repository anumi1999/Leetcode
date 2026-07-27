class Node{
    constructor(x){
        this.value = x;
        this.left = this.right = null;
    }
}

function BreadthFirstSearch(node, res, pos){
    if( node === null ){
        return;
    }
    if( res.length <= pos ){
        res.push([]);
    }
    res[pos].push(node.value);
    BreadthFirstSearch(node.left, res, pos+1);
    BreadthFirstSearch(node.right, res, pos+1);
}

function MaxDepth(node){
    if( node === null ){
        return -1;
    }
    let leftHeight = MaxDepth(node.left);
    let rightHeight = MaxDepth(node.right);
    return Math.max(leftHeight, rightHeight) + 1;
}

const root = new Node(1);
root.left = new Node(2);
root.right = new Node(3);
root.left.left = new Node(4);
root.left.right = new Node(5);
root.right.left = new Node(6);

const res = [];
BreadthFirstSearch(root, res, 0);

for (const level of res) {
    console.log(level.join(' '));
}
console.log( 'Max depth', MaxDepth(root));
