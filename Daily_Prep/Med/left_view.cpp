/**
 * class Tree {
 *     public:
 *         int val;
 *         Tree *left;
 *         Tree *right;
 * };
 */
vector<int> sol;
bool lvlorder( Tree* root , int lvl){
    if(root == nullptr){
        return false;
    }
    if(lvl == 1){
        sol.push_back(root->val);
        return true;
    }
    bool right = false;
    bool left = lvlorder(root->left , lvl - 1);
    if(left == false){
        right = lvlorder( root->right , lvl -1);
    }
    return left||right;
}
vector<int> solve(Tree* root) {
    int lvl = 1;
    while(lvlorder(root , lvl)){
        lvl++;
    }
    vector<int> p;
    for( auto it: sol){
        p.push_back(it);
    }
    sol.clear();
    return p;
}
