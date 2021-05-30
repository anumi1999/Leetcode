/* Given a string s, determine whether any anagram of s is a palindrome. */
bool solve(string s) {
    unordered_map<char , int> m;
    for(int i = 0 ; i < s.size() ; i++){
        m[s[i]]++;
    }
    int n = s.size();
    bool flag = false;
    if( n%2 == 1 ){
        int cnt = 0;
        for( auto i : m ){
            if( i.second % 2 == 1){
                cnt++;
                if(cnt > 1){
                    return flag;
                }
            }
        }
        flag = true;
    }else{
        for( auto i : m ){
            if( i.second % 2 == 1){
                    return flag;
                }
            }
            flag = true;
        }
    return flag;
}
