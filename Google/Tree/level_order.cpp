#include<bits/stdc++.h>

using namespace std;

int main(){
    queue<TreeNode* > q;
    vector<vector<int>> ans;
    q.push(root);
    int l = 0;
    while(!q.empty()){
        vector<int> levelAns;
        int levelSize = q.size();
        while(levelSize){
            TreeNode *t = q.front();
            if( t != nullptr ){
                levelAns.push_back(t->val);
                q.push(t->left);
                q.push(t->right);
            }
            q.pop();
            levelSize --;
        }
        ans.push_back(levelAns);
    }
    return 0;
}