#include<bits/stdc++.h>

using namespace std;

int max_sum = 0;
int maxPathSum(TreeNode *root ){
    if(root == nullptr){
        return 0;
    }
    int lHeight = maxPathSum(root->left);
    int rHeight = maxPathSum(root->right);

    if( lHeight + rHeight + root->val > max_sum ){
        max_sum = lHeight + rHeight + root->val;
    }

    return root->val + max(rHeight, lHeight);
}