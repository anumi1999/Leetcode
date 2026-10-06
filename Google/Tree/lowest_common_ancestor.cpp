#include<bits/stdc++.h>

using namespace std;

bool common_ancestor_p = false;
bool common_ancestor_q = false;
int ancestor = -1;
bool lca(TreeNode *root, int p, int q ){
    if(root == nullptr){
        return false;
    }
    if( root->val == p ){
        common_ancestor_p = true;
    }
    if( root->val == q ){
        common_ancestor_q = true;
    }
    int lHeight = lca(root->left, p, q);
    int rHeight = lca(root->right, p, q);
    if( common_ancestor_p && common_ancestor_q && ancestor == -1){
        ancestor = root->val;
        return true;
    }

    return lHeight || rHeight ;
}