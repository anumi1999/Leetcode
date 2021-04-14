#include<bits/stdc++.h>
using namespace std;
int main(){
    int n , k;
    cin >> n >> k;
    vector<int> v(n);
    for(int i = 0 ; i < n ; i++){
        int j;
        cin >> j;
        v[i] = j;
    }
    int index = 0;
    for( int i = 0 ; i < n ; i ++ ){
        int f = k - v[i];
        auto itr = find(v.begin(), v.end(), f);
        if (itr != v.end() && *itr != v[i] ){
            cout << "True";
            index = 1;
            break;
        }
    }
    if( index == 0 ){
        cout << "False";
    }
    return 0;
}
