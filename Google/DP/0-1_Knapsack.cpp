#include<bits/stdc++.h>

using namespace std;

int main(){
    int n , W;
    cin >> n >> W;
    vector<int> wt(n), val(n);
    for(int i = 0; i < n; i++) {
        cin >> wt[i] >> val[i];
    }
    vector<vector<int>> dp(n + 1, vector<int>(W + 1, 0));
    for(int i = 1; i <= n; i++) { 
        for(int w = 0; w <= W; w++) { 
            if(w >= wt[i-1]){
                dp[i][w] = max(dp[i-1][w], dp[i-1][w-wt[i-1]] + val[i-1]);
            } else {
                dp[i][w] = dp[i-1][w];
            }
        }
    }
    cout << dp[n][W] << endl;
    return 0;
}