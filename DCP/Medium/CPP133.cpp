#include<bits/stdc++.h>
using namespace std;

struct TreeNode{
    int val ;
    TreeNode *left;
    TreeNode *right;
    TreeNode *parent;
};
int left_successor( TreeNode *root ){
    if ( root->left == nullptr ){
        return root->data;
    }
    return left_successor( root->left );
}

int inorder_successor(TreeNode *val){
    if( val->right != nullptr ){
        return left_successor( val->right );
    }
    TreeNode* p = val -> parent;
    while( p!= nullptr && n == p->right ){
        n = p;
        p = p->parent ;
    }
    return p->val;
}
int main(){

    return 0;
}
