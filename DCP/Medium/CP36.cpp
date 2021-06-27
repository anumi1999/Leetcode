/**
 * Definition for a binary tree node.
 * struct TreeNode {
 *     int val;
 *     TreeNode *left;
 *     TreeNode *right;
 *     TreeNode() : val(0), left(nullptr), right(nullptr) {}
 *     TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}
 *     TreeNode(int x, TreeNode *left, TreeNode *right) : val(x), left(left), right(right) {}
 * };
 */
class Solution {
public:
    set<int> A;
    void setify(TreeNode* root){
        if( root == nullptr ){
            return;
        }
        setify(root->left);
        A.insert(root->val);
        setify(root->right);
    }
    int findSecondMinimumValue(TreeNode* root) {
        setify(root);
        if( A.size() < 2) {
            return -1;
        }
        else{
            auto it = A.begin();
            it++;
            return *it;
        }
        return -1;
    }
};
