void deepest_node_2(TreeNode* root){
    if( root == nullptr ){
        return;
    }
    TreeNode *temp = nullptr;
    queue<TreeNode* > q;
    q.push(root);
    while( q.size() > 0){
        temp = q.front();
        q.pop();
        if( root->left != nullptr )
            q.push(root->left);
        if( root->right != nullptr )
            q.push(root->right);
    }
    return temp;
}
