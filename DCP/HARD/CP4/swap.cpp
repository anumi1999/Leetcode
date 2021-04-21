#include<bits/stdc++.h>
using namespace std;
int main(){
    ios_base::sync_with_stdio(false) ;
    cin.tie(NULL) ;
    int n;
    cin >> n ;
    int arr[n];
    int ans = -1;
    unordered_map<int , int> hs;
    for( int i = 0 ; i < n ; i++){
        cin >> arr[i];
    }
    for( int i = 0 ; i < n ; i ++ ){
        while( arr[i] >= 1 && arr[i] <= n && arr[i] != arr[arr[i] - 1] ){
            swap( arr[i] , arr[arr[i] -1]);
        }
    }
    for ( int i = 0 ; i < n ; i++){
        if( arr[i] != i+1){
            ans = i+1;
        }
    }
    if( ans == -1 ){
        ans = n+1;
    }
    cout << ans;
    return 0;
}




