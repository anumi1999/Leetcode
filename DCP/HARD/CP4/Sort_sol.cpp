
#include<bits/stdc++.h>
using namespace std;
int main(){
    ios_base::sync_with_stdio(false) ;
    cin.tie(NULL) ;
    int n;
    cin >> n ;
    int arr[n];
    for( int i = 0 ; i < n ; i++){
        cin >> arr[i];
    }
    sort(arr , arr+n);
    int ans = -1, index = 0;
    for( int i = 0 ; i < n ; i++ ){
        if ( arr[i] <= 0 ){
            continue;
        }else{
            index++;
            if( arr[i] != index ){
                ans = index;
                break;
            }
        }
    }
    if( ans == -1 ){
        ans = index+1;
    }
    cout << ans;
    return 0;
}
