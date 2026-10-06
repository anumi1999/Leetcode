#include<bits/stdc++.h>

using namespace std;

int main(){
    int  n;
    cin >> n;
    vector<int> nums(n);
    int ansSum = 0;
    for( int i = 0 ; i < n ; i++ ){
        cin >> nums[i];
        ansSum+= nums[i];
    }
    if( (ansSum) % 2 != 0 ){
        cout << 0;
        return 0;
    }
    vector<vector<bool>> dp(n+1, vector<bool>(ansSum/2 + 1, false));

    dp[0][0] = true;

    for(int i = 1; i <= n ; i++){
        for(int j = 1; j <= ansSum/2; j++){
            if(nums[i-1] <= j){
                dp[i][j] = dp[i-1][j] || dp[i-1][j-nums[i-1]];
            }else{
                dp[i][j] = dp[i-1][j];
            }
        }
    }
    cout << dp[n][ansSum/2];
    return 0;
}