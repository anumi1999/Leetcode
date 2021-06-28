#include<bits/stdc++.h>
using namespace std;
int main(){
    int n ;
    cin >> n;
    int arr[n];
    for( int i = 0 ; i < n ; i++){
        cin >> arr[i];
    }
    int left = 0 , right = n-1 , left_max = 0 , right_max = 0 , ans = 0;
    while( left < right ){
        if( arr[left] < left_max ){
            ans += left_max - arr[left];
        }
        if( arr[left] > left_max){
            left_max = arr[left];
        }
        if( arr[right] > right_max){
            right_max = arr[right];
        }if( arr[right] < right_max){
            ans += right_max - arr[right];
        }
        if( arr[left] < arr[right] ){
            left++;
        }else{
            right --;
        }
    }
    cout << ans;
    return 0;
}
