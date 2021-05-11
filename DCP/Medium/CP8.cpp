int univeral(node *root){
    if( root == nullptr ){
        return 0;
    }
    if( root->left == nullptr && root->right == nullptr){
        return 1;
    }
    if ( root->left->value == root->right->value && root->value == root->right->value ){
        return 1 + univeral(root->left) + univeral(root->right);
    }

    return univeral(root->left) + univeral(root->right);
}
