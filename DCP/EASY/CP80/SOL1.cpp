struct TreeNode{
    int data;
    TreeNode* left;
    TreeNode* right;
};
void deepest_node(TreeNode* root , int level , int &max_level , int &res){
    if( root != nullptr ){
        deepest_node(root->left , ++level , max_level , res);
        if( level > max_level ){
            res = root->data;
            max_level = level;
        }
        deepest_node( root->right , ++level , max_level , res);
    }
}
void find_deepest_node(){
    TreeNode* root;
    int max_level = -1;
    int res = -1;
    deepest_node( root , 0 , max_level , res);
    cout << res;
}
