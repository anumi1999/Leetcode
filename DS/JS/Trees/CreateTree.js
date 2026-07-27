class Tree{
    constructor(x){
        this.data = x;
        this.children = [];
    }
}

class Node{
    constructor(x){
        this.value = x;
        this.left = this.right = null;
    }
}

let firstNode = new Node(2);
let secondNode = new Node(3);
let thirdNode = new Node(4);
let fourthNode = new Node(5);

firstNode.left = secondNode;
firstNode.right = thirdNode;
secondNode.left = fourthNode;

