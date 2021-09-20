void can_palindrome(){
    string s;
    unordered_map<char , int> m;
    for( int i = 0 ; i < s.size() ; i++ ){
        m[s[i]]++;
    }
    int cnt = 0;
    for( auto it = m.begin() ; it != m.end() ; it++ ){
        if( it.second % 2 == 1)
            cnt++;
    }
    if( s.size()%2 == 0 && cnt > 0 ){
        cout << "NOT POSSIBLE";
    }else if( s.size()%2 == 1 && cnt > 1){
        cout << "NOT POSSIBLE";
    }else{
        cout << "POSSIBLE";
    }
}
