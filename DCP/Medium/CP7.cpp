#include<bits/stdc++.h>
using namespace std;
vector<vector<int>> v;
vector<int> memo;
int permutations( int k , string s ){
    if( k == 0){
        return 1;
    }
    int start_ind = s.size() - k;
    if( s[start_ind] == '0' ){
        return 0;
    }
    if( memo[k] != -1){
        return memo[k];
    }
    int results = permutations( k - 1 , s );
    if( k >= 2 ){
        int ss = stoi( s.substr(start_ind, 2) );
        if( ss <= 26 )
            results += permutations( k - 2 , s );
    }
    memo[k] = results;
    return results;
}

int main(){
    string s;
    cin >> s;
    memo.resize(s.size() + 1 , -1) ;
    cout << permutations(s.size() , s);
    return 0;
}

