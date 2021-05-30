/*Given the root to a binary tree root, return the largest sum of any path that goes from the root to a leaf.*/

int solve(Tree* root) {
    if(root == nullptr){
        return 0;
    }   
    return max( solve(root->right) , solve(root->left)) + root->val;
}
