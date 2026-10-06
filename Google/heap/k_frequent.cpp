#include<bits/stdc++.h>

using namespace std;

int main(){
    unordered_map<int, int> mp;
    int n, k;
    cin >> n >> k;
    vector<int> arr(n);
    for( int i = 0 ; i < n; i++ ){ 
        cin >> arr[i];
        mp[arr[i]] ++;
    }
    priority_queue<pair<int, int>, vector<pair<int, int>>, greater<pair<int, int>>> minHeap;
    for( auto it = mp.begin(); it != mp.end(); it++ ){
        if( minHeap.size() < k ){
            minHeap.push({it->second, it->first});
        }else if( it->second > minHeap.top().first ){
            minHeap.pop();
            minHeap.push({it->second, it->first});
        } 
    }
    while( !minHeap.empty() ){
        cout << minHeap.top().second << " ";
        minHeap.pop();
    }
    return 0;
}