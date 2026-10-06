#include<bits/stdc++.h>

using namespace std;

bool pathSum(TreeNode* root, int sum){
    if( root == nullptr ){
        return false;
    }
    if( root->left == nullptr && root->right == nullptr && sum - root->val == 0 ){
        return true;
    }
    if( root->left == nullptr && root->right == nullptr && sum - root->val != 0 ){
        return false;
    }
    return pathSum(root->left, sum - root->val) || pathSum(root->right, sum - root->val);
}