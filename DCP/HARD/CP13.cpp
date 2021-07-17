#include<bits/stdc++.h>
using namespace std;

int main(){
    int max_cnt = 0 , start_ind = 0 , k , j = 0;
    string s;
    unordered_map<char , int> m;
    cin >> s;
    cin >> k;
    for( auto i: s){
        if( m.size() <= k){
            m[i] = j;
        }
        else{
            int start_index = INT_MAX;
            char pop_char;
            for( auto it: m){
                if( it.second < start_index ){
                        pop_char = it.first;
                        start_index = it.second;
                }
            }
            start_ind = start_index+1;
            m.erase(pop_char);
        }
        max_cnt = max( max_cnt , j - start_ind );
        j++;
    }
    cout << max_cnt;
    return 0;
}

