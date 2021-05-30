/* Given an integer n, return first n integers sorted in lexicographic order.*/
vector<int> solve(int n) {
    vector<int> v;
    vector<string> temp;
    for(int i = 1 ; i <= n ; i++ ){
        temp.push_back(to_string(i));
    }
    sort(temp.begin(), temp.end());
    for(int i = 0 ; i < n ; i++){
        v.push_back(stoi(temp[i]));
    }
    return v; 
}
