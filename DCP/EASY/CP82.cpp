void readN(int n , string s){
    string p = "";
    int cnt = 0;
    for( int i = 0 ; i < s.size() ; i++){
        cnt++;
        p+= s[i];
        if( cnt == n ){
            cout << p << "\n";
            cnt = 0;
            p = "";
        }
    }
}
void readNfromS(){
    int n;
    string s;
    cin >> n;
    cin >> s;
    readN( n , s );
}
