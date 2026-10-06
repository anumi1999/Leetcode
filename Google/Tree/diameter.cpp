#include<bits/stdc++.h>

using namespace std;

int max_diameter = 0;
int diameter(TreeNode *root ){
    if(root == nullptr){
        return 0;
    }
    int lHeight = diameter(root->left);
    int rHeight = diameter(root->right);

    if( lHeight + rHeight > max_diameter ){
        max_diameter = lHeight + rHeight;
    }

    return 1 + max(rHeight, lHeight);
}