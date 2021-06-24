#include<bits/stdc++.h>
using namespace std;
const int A_S = 26;

int main(){
    int n , k;
    cin >> n >> k ;
    int arr[n];
    for(int i = 0 ; i < n ; i++ ){
        cin >> arr[i];
    }
    deque<int> Q(k);
    int i ;
    for( i = 0 ; i < k ; i++){
        while( (!Q.empty()) && (arr[i] >= arr[Q.back()]) )
            Q.pop_back();
        Q.push_back(i);
    }
    for( ; i < n ; i++ ){
        cout << arr[Q.front()] << endl;
        while( (!Q.empty()) &&  Q.front() <= i-k ){
            Q.pop_front();
        }
        while((!Q.empty()) && (arr[i] >= arr[Q.back()])){
            Q.pop_back();
        }
        Q.push_back(i);
    }
    cout << arr[Q.front()];
    return 0;
}
