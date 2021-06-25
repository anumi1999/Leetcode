#include<bits/stdc++.h>
using namespace std;
const int A_S = 26;

int main(){
    int n , k;
    cin >> n >> k ;
    int mat[n][k];
    for( int i = 0 ; i < n ; i++ ){
        for(int j = 0 ; j < k ; j++){
            cin >> mat[i][j];
        }
    }

    int sum = 0;
    int last_k = -1;
    int cost_price[n][k];
    for( int i = 0 ; i < n ; i++){
        for( int j = 0 ; j < k ; j++){
            if( i == 0){
                cost_price[i][j] = mat[i][j];
            }else{
                int min_cost = INT_MAX;
                for( int p = 0 ; p < k ; p++  ){
                    if( p != j && min_cost > cost_price[i-1][p] ){
                        min_cost = cost_price[i-1][p];
                    }
                }
                cost_price[i][j] = mat[i][j] + min_cost;
            }
        }
    }
    int sol = INT_MAX;
    for( int i = 0 ; i < k ; i++){
        sol = min(sol , cost_price[n-1][i]);
    }
    cout << sol;
    return 0;
}
