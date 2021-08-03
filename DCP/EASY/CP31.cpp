#include<bits/stdc++.h>
using namespace std;

int main(){
    int n , m;
    string s1 , s2;
    // cin >> s1 >> s2;
    s1 = "sitting";
    s2 = "kitten";
    m = s1.size();
    n = s2.size();
    int dp[m+1][n+1];
    for( int i = 0 ; i < m+1 ; i++ ){
        dp[i][0] = i;
    }
    for( int j = 0 ; j < n + 1 ; j++ ){
        dp[0][j] = j;
    }
    for( int i = 1 ; i < m+1 ; i++ ){
        for(int j = 1 ; j < n+1 ; j++ ){
            if( s1[i-1] == s2[j-1] ){
                dp[i][j] = dp[i-1][j-1];
            }else{
                dp[i][j] = 1 + min( dp[i-1][j] , min(dp[i][j-1] , dp[i-1][j-1]));
            }
        }
    }
    for( int i = 0 ; i < m+1 ; i++ ){
        for(int j = 0 ; j < n+1 ; j++ ){
            cout << dp[i][j] << " ";
        }
        cout << endl;
    }
    cout << dp[m][n];
    return 0;
}
