class Solution {
public:
    string longestPalindrome(string s) {
        string x = s;
        int n = s.size();
        int dp[n+1][n+1];
        int result = 0 ;
        int row , col ; 
        for( int i = 0 ; i <= n ; i++ ){
            for( int j = 0 ; j <= n ; j++ ){
                if( i == 0 || j == 0 )
                    dp[i][j] = 0;
                else if( x[i-1] == s[j-1] ){
                    dp[i][j] = dp[i-1][j-1] + 1;
                    if( result < dp[i][j] ){
                        result = dp[i][j];
                        row = i;
                        col = j;
                    }
                }else{
                    dp[i][j] = 0;
                } 
            }
        }
        if( result == 0 )   
            return "";
        cout << row << " " << col ; 
        string ans;
        ans.resize(result);
        while( dp[row][col] != 0 ){
            ans[--result] += x[row-1];
            row--;
            col--;
        }
        return ans;
    }
};
