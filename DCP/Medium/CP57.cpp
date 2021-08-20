void check_len(){
    string s;
    getline(cin , s);
    int k;
    cin >> k;
    vector<pair<string , int> > v;
    string p = "";
    int cnt = 0;
    for( int i = 0 ; i < s.size() ; i++ ){
        if( s[i] != ' ' ){
            p+= s[i];
            cnt++;
        }else{
            v.push_back(make_pair(p , cnt));
            p = "";
            cnt = 0;
        }
    }
    v.push_back(make_pair(p , cnt));
    string o = "";
    cnt = 0;
    vector<string> sol;
    for( auto i: v ){
        if( i.second + cnt <= k ){
            cnt+= i.second;
            o += i.first;
            o += " ";
            cnt++;
        }else{
            if( o[cnt - 1] == ' '){
                string l = "";
                for( int i = 0 ; i < cnt - 1 ; i++ ){
                    l+= o[i];
                }
                sol.push_back(l);
            }
            o = "";
            cnt = 1 + i.second;
            o += i.first + " ";
        }
    }
    string l = "";
    for( int i = 0 ; i < cnt - 1 ; i++ ){
        l+= o[i];
    }
    sol.push_back(l);
    for( auto i : sol )
        cout << "[ '" << i << "' ]";
}
