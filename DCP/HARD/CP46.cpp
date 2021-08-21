void lo_c_substring_palindrome(){
    string s1;
    cin >> s1;
    int m;
    m = s1.size();
    string t = s1;
    reverse(s1.begin() , s1.end());
    int dp[m+1][m+1];
    int end_ind = 0;
    int sol = 0;
    for( int i = 0; i <= m ; i++ ){
        for( int j = 0 ; j <= m ; j++ ){
            if( i == 0 || j == 0)
                dp[i][j] = 0;
            else if( s1[i-1] == t[j-1] )
            {
                dp[i][j] = dp[i-1][j-1] + 1;
                if( sol < dp[i][j]){
                    sol = max( sol , dp[i][j] );
                    end_ind = i;
                }

            }else{
                dp[i][j] = 0;
            }
        }
    }
    cout << s1.substr(end_ind - sol , end_ind);
}
