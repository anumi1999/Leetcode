/* This problem was asked by Airbnb.

Given a list of integers, write a function that returns the largest sum of non-adjacent numbers. Numbers can be 0 or negative.

For example, [2, 4, 6, 2, 5] should return 13, since we pick 2, 6, and 5. [5, 1, 1, 5] should return 10, since we pick 5 and 5.

Follow-up: Can you do this in O(N) time and constant space?

Sol 1: O(n^2): iterate through same array twice
Sol 2: DP O(n) and O(1)*/

#include<bits/stdc++.h>
using namespace std;
int main(){
    int n;
    cin >> n ;
    int arr[n];
    for(int i = 0 ; i < n ; i ++){
        cin >> arr[i];
    }
    if( n <= 2 ){
        cout<< n;
    }else{
        int sum = 0;
        int first = 0 , second = 0;
        for( int i = n-1; i >= 0 ; i-- ){
            sum = max( arr[i] + second , first);
            second = first;
            first = sum;
        }
        cout << first;
    }
    return 0;
}
