/* Given a list of numbers and a number k, return whether any two numbers from the list add up to k.
For example, given [10, 15, 3, 7] and k of 17, return true since 10 + 7 is 17. */

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
