class Solution {
public:
    int longestPalindromeSubseq(string s) {
        string y = s;
        reverse(y.begin() , y.end());
        int n = s.size();
        int lcs[n+1][n+1];
        for( int i = 0 ; i<= n ; i++){
            for( int j = 0 ; j <= n ; j++){
                if( i == 0 || j == 0 ){
                    lcs[i][j] = 0;
                }else if( s[i-1] == y[j-1] ){
                    lcs[i][j] = lcs[i-1][j-1] + 1;
                }else{
                    lcs[i][j] = max(lcs[i-1][j] , lcs[i][j-1]);
                }
            }
        }
        return lcs[n][n];
    }
};
