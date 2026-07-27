class Node{
    constructor(x){
        this.value = x;
        this.left = this.right = null;
    }
}

function inorderTraversal( node, res ){
    if(node === null){
        return;
    }
    inorderTraversal(node.left, res);
    res.push(node.value);
    inorderTraversal(node.right, res);
}

function preorderTraversal(node , res){
    if( node === null ){
        return;
    }
    res.push(node.value);
    preorderTraversal(node.left, res);
    preorderTraversal(node.right, res);
}

function postorderTraversal(node , res){
    if( node === null ){
        return;
    }
    postorderTraversal(node.left, res);
    postorderTraversal(node.right, res);
    res.push(node.value);
}

const root = new Node(1);
root.left = new Node(2);
root.right = new Node(3);
root.left.left = new Node(4);
root.left.right = new Node(5);
root.right.left = new Node(6);

const inorderRes = [];
const preorderRes = [];
const postorderRes = [];
inorderTraversal(root, inorderRes);
preorderTraversal(root, preorderRes);
postorderTraversal(root, postorderRes);
console.log(inorderRes.join(' '));
console.log(preorderRes.join(' '));
console.log(postorderRes.join(' '));
