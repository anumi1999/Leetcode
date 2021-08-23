int res;
    int solve(TreeNode * root){
        if(root==NULL)return 0;
        int l =solve(root->left);
        int r=solve(root->right);
        int v= root->val;
        res=max({res, v + l, v+r, v, l+v+r});
        return max({l+v, r+v,v});
    }
    int maxPathSum(TreeNode* root) {
        res=-10002;
        solve(root);
        return res;
    }
