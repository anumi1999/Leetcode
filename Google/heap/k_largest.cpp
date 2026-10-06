#include<bits/stdc++.h>

using namespace std;

int main(){
    int n, k;
    cin >> n >> k;
    vector<int> arr(n);
    priority_queue<int, vector<int>, greater<int>> minHeap;
    for( int i = 0 ; i < n; i++ ){
        cin >> arr[i];
    }
    for( int i = 0 ; i < n ; i++ ){
        if( minHeap.size() < k ){
            minHeap.push(arr[i]);
        }else if(arr[i] > minHeap.top()){
            minHeap.pop();
            minHeap.push(arr[i]);
        }
    }
    cout << minHeap.top();
    return 0;
}