#include<bits/stdc++.h>

using namespace std;

bool inorder(TreeNode* root, long &prev){
    if(!root){
        return true;
    }
    if(!inorder(root->left, prev)){
        return false;
    }
    if ( prev >= root->val){
        return false;
    }
    prev = root->val;
    return inorder(root->right, prev);
}
bool validBST( TreeNode* root){
    long prev = LONG_MIN; 
    return inorder(root, prev);
}