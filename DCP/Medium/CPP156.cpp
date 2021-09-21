#include<bits/stdc++.h>
using namespace std;

int main(){
    int n ;
    cin >> n;
    int dp[n+1];
    memset( dp , 10001 , sizeof(dp));
    for( int i = 0 ; i * i <= n ; i++ ){
        dp[i*i] = 1;
    }
    for( int i = 2 ; i <= n ; i++ ){
        for( int j = 0 ; j * j <= i ; j++ ){
            dp[i] = min( dp[i] , dp[i - (j * j)] + 1 );
        }
    }
    for( int i = 0 ; i<= n ; i++ )
        cout << dp[i] << " " ;
    return 0;
}
