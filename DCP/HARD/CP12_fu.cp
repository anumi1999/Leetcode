#include<bits/stdc++.h>
using namespace std;
vector<int> tab;

int count_stairs(int stairs , int min_stair , int X[] , int n){
    if( stairs == min_stair){
        return tab[min_stair];
    }
    if( tab[stairs] != -1 ){
        return tab[stairs];
    }
    for( int i = 0 ; i < n ; i++ ){
        if( stairs - X[i] >= 0){
            tab[stairs] += count_stairs( stairs - X[i] , min_stair , X , n);
        }
    }
    cout << "For Stair No: " << stairs << "\n" ;
    cout << ++tab[stairs] << "\n" ;
    return tab[stairs];
}
int main(){
    int stairs ;
    cin >> stairs;
    int n;
    cin >> n ;
    int X[n];
    int min_stair = INT_MAX;
    for( int i = 0 ; i < n ; i++ ){
        cin >> X[i];
        min_stair = min(min_stair , X[i]);
    }
    cout << "MIN_stair : " << min_stair << "\n" ;
    tab.resize(stairs + 1 , -1);
    tab[min_stair] = 1;
    for( int i = 1 ; i < min_stair ; i++){
        tab[i] = 0;
    }
    tab[0] = 1;
    cout << count_stairs(stairs , min_stair , X , n);
    return 0;
}
